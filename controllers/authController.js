const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const joi = require('joi')

exports.registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body

        const schema = joi.object({
            name: joi.string().min(2).max(20).trim().required(),
            email: joi.string().email().trim().lowercase().required(),
            password: joi.string().regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/).required()
        })

        const { error } = schema.validate({ name, email, password })
        if(error){
            return res.status(400).json({ success: false, message: "Input is Invalid!" , error })
        }

        const user = await User.findOne({ email })
        if(user){
            return res.status(400).json({ success: false, message: "Email already registered!" })
        }

        const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALTS))

        const newUser = new User({
            name,
            email,
            password: hashedPassword
        })

        await newUser.save()

        res.status(201).json({ success: true, message: "User registered successfully!" })
    }catch(err){
        res.status(500).json({ message: 'Server error' });
    }
}

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body

        const schema = joi.object({
            email: joi.string().email().trim().lowercase().required(),
            password: joi.string().regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/).required()
        })

        const { error } = schema.validate({ email, password })
        if(error){
            return res.status(400).json({ success: false, message: "Input is Invalid!" , error })
        }

        const user = await User.findOne({ email })
        if(!user){
            return res.status(400).json({ success: false, message: "Email not registered!" })
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if(!isMatch){
            return res.status(400).json({ success: false, message: "Incorrect Password!" })
        }

        const token = jwt.sign({
            userId: user._id,
            name: user.name
        }, process.env.JWT_SECRET, { expiresIn: '1d' })

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: "lax"
        }).status(200).json({
            success: true,
            message: "Logged In successfully!",
            user: { name: user.name, id: user._id }
        })
    }catch(err){
        res.status(500).json({ message: 'Server error' });
    }
}

exports.getCurrentUser = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            user: {
                id: req.user.userId,
                name: req.user.name,
            },
        })
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' })
    }
}
